const puppeteer = require('puppeteer');
const { autoScrollAndGatherFields } = require('../utils/formUtils');
const { formatWithGPT, formatWithGPTForCaptcha } = require('./openaiService');

async function fillGreenhouseApplication(jobUrl, resumeData) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  try {
    // Navigate to the job application page
    await page.goto(jobUrl);
    
    // Wait for the form to load
    await page.waitForSelector('#application_form');

    // Get all form fields while scrolling
    const formFields = await autoScrollAndGatherFields(page);

    // Map resume data to form fields
    for (const field of formFields) {
      try {
        // Handle basic personal info fields
        if (field.id === 'first_name') {
          await page.type('#' + field.id, resumeData.personalInfo.firstName);
        } else if (field.id === 'last_name') {
          await page.type('#' + field.id, resumeData.personalInfo.lastName);
        } else if (field.id === 'email') {
          await page.type('#' + field.id, resumeData.personalInfo.email);
        } else if (field.id === 'phone') {
          await page.type('#' + field.id, resumeData.personalInfo.phone);
        } else if (field.id === 'auto_complete_input') {
          await page.type('#' + field.id, resumeData.personalInfo.location);
        }
        
        // Handle custom fields based on name patterns
        if (field.name?.includes('answers_attributes')) {
          if (field.type === 'select-one') {
            // Handle dropdowns
            await page.select(`select[name="${field.name}"]`, field.options[0].value);
          } else if (field.type === 'text') {
            // Handle text inputs - try to intelligently match based on placeholder or name
            let value = '';
            if (field.placeholder?.toLowerCase().includes('linkedin')) {
              value = resumeData.linkedIn || '';
            } else if (field.placeholder?.toLowerCase().includes('website')) {
              value = resumeData.website || '';
            } else if (field.placeholder?.toLowerCase().includes('referral')) {
              value = resumeData.referral || '';
            }
            await page.type(`input[name="${field.name}"]`, value);
          } else if (field.type === 'checkbox') {
            // Handle consent checkboxes
            await page.click(`input[name="${field.name}"]`);
          }
        }
      } catch (fieldError) {
        console.warn(`Error filling field ${field.id || field.name}:`, fieldError);
      }
    }

    // Optional: Take a screenshot for verification
    await page.screenshot({ path: 'application-filled.png', fullPage: true });

  } catch (error) {
    console.error('Error filling application:', error);
  } finally {
    await browser.close();
  }
}

async function fillGreenhouseApplicationV2(jobUrl, resumeData) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  try {
    // Navigate to the job application page
    await page.goto(jobUrl);
    
    // Wait for the application form to load
    if (jobUrl.includes('job-boards.greenhouse.io')) {
      await page.waitForSelector('#application-form');
    } else if (jobUrl.includes('boards.greenhouse.io')) {
      await page.waitForSelector('#application_form'); 
    }

    // First pass - gather all form fields while scrolling
    const formFields = await autoScrollAndGatherFields(page);

    console.log(formFields, 'formFields');

    // Use GPT to map resume data to form fields
    const mappingPrompt = {
      formFields,
      resumeData
    };
    
    console.log(mappingPrompt, 'mappingPrompt');
    
    const fieldMappings = await formatWithGPT(mappingPrompt);
    console.log(fieldMappings, 'fieldMappings after gpt');
    const mappings = JSON.parse(fieldMappings.replace(/^```json|```$/g, ''));
    console.log(mappings, 'mappings after gpt');

    // Second pass - fill out the form using the AI-generated mappings
    for (const mapping of Object.values(mappings.formFields)) {
      await new Promise(resolve => setTimeout(resolve, 500)); // wait for 1 second between each field
      try {
        const { id: selectorId, value, type } = mapping;
        const selector = `#${selectorId}`;

        if (selectorId === '') {
          continue;
        }

        if (type === 'text' || type === 'email' || type === 'tel') {
          console.log('typing', value);
          console.log('selector', selector);
          await page.type(selector, value || 'no');
          await new Promise(resolve => setTimeout(resolve, 500)); // wait a half second
          await page.keyboard.press('Tab');
        } else if (type === 'select-one') {
          await page.select(selector, value);
        } else if (type === 'file') {
          const input = await page.$(selector);
          if (input) {
            await input.uploadFile(value);
          }
        } else if (type === 'checkbox') {
          // continue;
          await page.click(selector.replace(/([\[\]])/g, '\\$1'));
        }
      } catch (fieldError) {
        console.warn(`Error filling field ${mapping.id}:`, fieldError);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    await page.waitForSelector('.application--submit button', { visible: true });
    await page.click('.application--submit button');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Optional: Take screenshot before submitting
    const screenshotName = jobUrl.split('/').pop().replace(/\W+/g, '-');
    await page.screenshot({ path: `application-${screenshotName}.png`, fullPage: true });

    // Submit form
    // page mouseover first to avoid verification ( make it humnan behavior like)
    await page.click('button[type="submit"]');

  } catch (error) {
    console.error('Error filling application:', error);
  } finally {
    await browser.close();
  }
}

async function fillLeverApplication(jobUrl, resumeData) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  try {
    // Navigate to the job application page
    await page.goto(jobUrl);
    
    // Wait for the application form to load
    await page.waitForSelector('#application-form');

    // First pass - gather all form fields while scrolling
    const formFields = await autoScrollAndGatherFields(page);

    console.log(formFields, 'formFields');

    // Use GPT to map resume data to form fields
    const mappingPrompt = {
      formFields,
      resumeData
    };
    
    console.log(mappingPrompt, 'mappingPrompt');
    
    const fieldMappings = await formatWithGPT(mappingPrompt);
    console.log(fieldMappings, 'fieldMappings after gpt');
    const mappings = JSON.parse(fieldMappings.replace(/^```json|```$/g, ''));
    console.log(mappings, 'mappings after gpt');

    // Second pass - fill out the form using the AI-generated mappings
    for (const mapping of Object.values(mappings.formFields)) {
      // Random delay between 1-3 seconds between fields
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
      try {
        // Check for h-captcha before each field interaction
        const hCaptcha = await page.$('#h-captcha');
        const captchaBounds = await hCaptcha?.boundingBox();
        const iframes = await hCaptcha?.$$('iframe');
        const visibleIframe = await Promise.all(
          (iframes || []).map(async iframe => {
            const visibility = await iframe.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.visibility === 'visible';
            });
            return visibility;
          })
        );
        if (hCaptcha && captchaBounds?.height > 0 && visibleIframe.some(visible => visible)) {
          // Take screenshot of the captcha
          // Take screenshot and convert to base64
          const screenshotBuffer = await hCaptcha.screenshot();
          await fs.writeFileSync('captcha.png', screenshotBuffer);
          const base64Image = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
          
          // Send base64 image to GPT for analysis
          const captchaAnalysis = await formatWithGPTForCaptcha(base64Image);
          
          // Parse the position to click from GPT response
          const position = JSON.parse(captchaAnalysis);
          
          // Get captcha dimensions
          const captchaBounds = await hCaptcha.boundingBox();
          
          // Click the specified position
          await page.mouse.click(
            captchaBounds.x + (position.x * captchaBounds.width),
            captchaBounds.y + (position.y * captchaBounds.height)
          );
          
          // Wait for captcha to process
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const { id: selectorId, value, type } = mapping;
        const selector = `#${selectorId}`;

        if (selectorId === '') {
          continue;
        }

        if (type === 'text' || type === 'email' || type === 'tel') {
          console.log('typing', value);
          console.log('selector', selector);
          
          // Type each character with a random delay
          const chars = (value || 'no').split('');
          for (const char of chars) {
            await page.type(selector, char, {delay: Math.random() * 200 + 50}); // 50-250ms delay between keystrokes
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200)); // Random pause after typing
          await page.keyboard.press('Tab');
          
        } else if (type === 'select-one') {
          await page.select(selector, value);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          
        } else if (type === 'file') {
          const input = await page.$(selector);
          if (input) {
            await input.uploadFile(value);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
          }
          
        } else if (type === 'checkbox') {
          await page.hover(selector.replace(/([\[\]])/g, '\\$1')); // Hover first
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
          await page.click(selector.replace(/([\[\]])/g, '\\$1'));
        }
      } catch (fieldError) {
        console.warn(`Error filling field ${mapping.id}:`, fieldError);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optional: Take screenshot before submitting
    const screenshotName = jobUrl.split('/').pop().replace(/\W+/g, '-');
    await page.screenshot({ path: `application-${screenshotName}.png`, fullPage: true });

    // Submit form with human-like behavior
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await page.hover('button[type="submit"]'); // Hover first
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      await page.click('button[type="submit"]');
    }

  } catch (error) {
    console.error('Error filling application:', error);
  } finally {
    await browser.close();
  }
}

async function fillWorkableApplication(jobUrl, resumeData) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  try {
    // Navigate to the job application page
    await page.goto(jobUrl);

    // Wait for and handle cookie consent
    await page.waitForSelector('[data-ui="cookie-consent-accept"]');
    const acceptCookiesButton = await page.$('[data-ui="cookie-consent-accept"]');
    if (acceptCookiesButton) {
      await page.hover('[data-ui="cookie-consent-accept"]'); // Hover first
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
      await acceptCookiesButton.click();
    }
    
    // Wait for and click the Apply Now button
    await page.waitForSelector('[data-ui="overview-apply-now"]');
    const applyButton = await page.$('[data-ui="overview-apply-now"]');
    if (applyButton) {
      await page.hover('[data-ui="overview-apply-now"]'); // Hover first
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
      await applyButton.click();
    }

    // Wait for the application form to load after clicking apply
    await page.waitForSelector('[data-ui="application-form"]');

    // First pass - gather all form fields while scrolling
    const formFields = await autoScrollAndGatherFields(page);

    console.log(formFields, 'formFields');

    // Use GPT to map resume data to form fields
    const mappingPrompt = {
      formFields,
      resumeData
    };
    
    console.log(mappingPrompt, 'mappingPrompt');
    
    const fieldMappings = await formatWithGPT(mappingPrompt);
    console.log(fieldMappings, 'fieldMappings after gpt');
    const mappings = JSON.parse(fieldMappings.replace(/^```json|```$/g, ''));
    console.log(mappings, 'mappings after gpt');

    // Second pass - fill out the form using the AI-generated mappings
    for (const mapping of Object.values(mappings.formFields)) {
      // Random delay between 1-3 seconds between fields
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
      try {
        // Check for h-captcha before each field interaction
        const hCaptcha = await page.$('#h-captcha');
        const captchaBounds = await hCaptcha?.boundingBox();
        const iframes = await hCaptcha?.$$('iframe');
        const visibleIframe = await Promise.all(
          (iframes || []).map(async iframe => {
            const visibility = await iframe.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.visibility === 'visible';
            });
            return visibility;
          })
        );
        if (hCaptcha && captchaBounds?.height > 0 && visibleIframe.some(visible => visible)) {
          // Take screenshot of the captcha
          // Take screenshot and convert to base64
          const screenshotBuffer = await hCaptcha.screenshot();
          await fs.writeFileSync('captcha.png', screenshotBuffer);
          const base64Image = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
          
          // Send base64 image to GPT for analysis
          const captchaAnalysis = await formatWithGPTForCaptcha(base64Image);
          
          // Parse the position to click from GPT response
          const position = JSON.parse(captchaAnalysis);
          
          // Get captcha dimensions
          const captchaBounds = await hCaptcha.boundingBox();
          
          // Click the specified position
          await page.mouse.click(
            captchaBounds.x + (position.x * captchaBounds.width),
            captchaBounds.y + (position.y * captchaBounds.height)
          );
          
          // Wait for captcha to process
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const { id: selectorId, value, type } = mapping;
        const selector = `#${selectorId}`;

        if (selectorId === '') {
          continue;
        }

        if (type === 'text' || type === 'email' || type === 'tel') {
          console.log('typing', value);
          console.log('selector', selector);
          
          // Type each character with a random delay
          const chars = (value || 'no').split('');
          for (const char of chars) {
            await page.type(selector, char, {delay: Math.random() * 200 + 50}); // 50-250ms delay between keystrokes
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200)); // Random pause after typing
          await page.keyboard.press('Tab');
          
        } else if (type === 'select-one') {
          await page.select(selector, value);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          
        } else if (type === 'file') {
          const input = await page.$(selector);
          if (input) {
            await input.uploadFile(value);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
          }
          
        } else if (type === 'checkbox') {
          await page.hover(selector.replace(/([\[\]])/g, '\\$1')); // Hover first
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
          await page.click(selector.replace(/([\[\]])/g, '\\$1'));
        }
      } catch (fieldError) {
        console.warn(`Error filling field ${mapping.id}:`, fieldError);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optional: Take screenshot before submitting
    const screenshotName = jobUrl.split('/').pop().replace(/\W+/g, '-');
    await page.screenshot({ path: `application-${screenshotName}.png`, fullPage: true });

    // Submit form with human-like behavior
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await page.hover('button[type="submit"]'); // Hover first
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      await page.click('button[type="submit"]');
    }

  } catch (error) {
    console.error('Error filling application:', error);
  } finally {
    await browser.close();
  }
}

module.exports = {
  fillGreenhouseApplication,
  fillGreenhouseApplicationV2,
  fillLeverApplication,
  fillWorkableApplication
};