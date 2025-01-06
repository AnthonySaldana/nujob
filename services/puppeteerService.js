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
  const browser = await puppeteer.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });
  const page = await browser.newPage();

  // Mask automation
  await page.evaluateOnNewDocument(() => {
    // Overwrite the 'navigator.webdriver' property to make it undefined
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // Add missing chrome properties
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  });

  // Set a more realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Add random initial delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));

    // Navigate to the job application page
    await page.goto(jobUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Add random delay before interacting with form
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

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
    
    const fieldMappings = await formatWithGPT(mappingPrompt);
    const mappings = JSON.parse(fieldMappings.replace(/^```json|```$/g, ''));

    // Add random mouse movements between interactions
    async function moveMouseRandomly() {
      const viewportSize = await page.viewport();
      const x = Math.floor(Math.random() * viewportSize.width);
      const y = Math.floor(Math.random() * viewportSize.height);
      await page.mouse.move(x, y, { steps: 10 });
    }

    console.log(mappings.formFields, 'mappings.formFields here just going now');

    // Second pass - fill out the form using the AI-generated mappings
    for (const mapping of Object.values(mappings.formFields)) {
      // Add random mouse movement
      await moveMouseRandomly();
      
      // Random delay between 2-5 seconds between fields
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
      
      try {
        // Check for h-captcha before each field interaction
        const hCaptcha = await page.$('#h-captcha');
        const captchaBounds = await hCaptcha?.boundingBox();
        const iframes = await hCaptcha?.$$('iframe');
        console.log(iframes, 'iframes here just going now');
        const visibleIframe = await Promise.all(
          (iframes || []).map(async iframe => {
            const visibility = await iframe.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.visibility === 'visible';
            });
            return visibility;
          })
        );
        console.log(visibleIframe, 'visibleIframe here just going now');
        if (visibleIframe.some(visible => visible)) {
          console.log('taking screenshot');
          // Find the visible iframe and take screenshot of it
          const visibleIframeElement = (await Promise.all(iframes.map(async (iframe, index) => {
            const visible = visibleIframe[index];
            return visible ? iframe : null;
          }))).find(iframe => iframe !== null);
          
          if (!visibleIframeElement) {
            console.log('No visible iframe found');
            return;
          }

          try {
            const screenshotBuffer = await visibleIframeElement.screenshot({ 
              path: `captcha-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
            });
            const base64Image = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            console.log('taking screenshot done');

            const captchaAnalysis = await formatWithGPTForCaptcha(base64Image);
            console.log(captchaAnalysis, 'captchaAnalysis');
            
            // Parse the position to click from GPT response
            const position = JSON.parse(
              captchaAnalysis.includes('```json') 
                ? captchaAnalysis.replace(/^```json\n|\n```$/g, '')
                : captchaAnalysis
            );
            
            const iframeBounds = await visibleIframeElement.boundingBox();
            if (!iframeBounds) {
              console.log('Could not get iframe bounds');
              return;
            }

            // Add human-like movement before clicking captcha
            await page.mouse.move(
              iframeBounds.x + (position.x * iframeBounds.width),
              iframeBounds.y + (position.y * iframeBounds.height),
              { steps: 25 }
            );
            
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            
            await page.mouse.click(
              iframeBounds.x + (position.x * iframeBounds.width),
              iframeBounds.y + (position.y * iframeBounds.height)
            );

            console.log('clicked captcha');
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.error('Error handling captcha:', error);
          }
        }

        const { id: selectorId, value, type } = mapping;
        const selector = `#${selectorId}`;

        if (selectorId === '') {
          continue;
        }

        console.log(selector, 'selector here just going now');

        // Add mouse movement to field before interaction
        const element = await page.$(selector);
        if (element) {
          const box = await element.boundingBox();
          if (box) {
            await page.mouse.move(
              box.x + box.width / 2,
              box.y + box.height / 2,
              { steps: 15 }
            );
          }
        }

        if (type === 'text' || type === 'email' || type === 'tel') {
          console.log('typing', value);
          console.log('selector', selector);
          
          await page.click(selector, { clickCount: 3 }); // Select all existing text
          await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
          
          // Type each character with variable delay
          const chars = (value || 'no').split('');
          for (const char of chars) {
            await page.keyboard.type(char, {delay: Math.random() * 150 + 30}); // 30-180ms delay
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
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
          await page.hover(selector.replace(/([\[\]])/g, '\\$1'));
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
          await page.click(selector.replace(/([\[\]])/g, '\\$1'));
        }
      } catch (fieldError) {
        console.warn(`Error filling field ${mapping.id}:`, fieldError);
      }
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    // Optional: Take screenshot before submitting
    const screenshotName = jobUrl.split('/').pop().replace(/\W+/g, '-');
    await page.screenshot({ path: `application-${screenshotName}.png`, fullPage: true });

    // Submit form with human-like behavior
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await page.hover('button[type="submit"]');
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
        let hCaptchaVisible = false;
        if (hCaptcha && captchaBounds?.height > 0 && visibleIframe.some(visible => visible)) {
          hCaptchaVisible = true;
        }
        while (hCaptchaVisible) {
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
            const screenshotBuffer = await hCaptcha.screenshot();
            await fs.writeFileSync('captcha.png', screenshotBuffer);
            const base64Image = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            
            // Send base64 image to GPT for analysis
            const captchaAnalysis = await formatWithGPTForCaptcha(base64Image);
            console.log(captchaAnalysis, 'captchaAnalysis');
            
            // Parse the position to click from GPT response, handling both raw JSON and code block formats
            const position = JSON.parse(
              captchaAnalysis.includes('```json') 
                ? captchaAnalysis.replace(/^```json\n|\n```$/g, '')
                : captchaAnalysis
            );
            
            // Get captcha dimensions
            const captchaBounds = await hCaptcha.boundingBox();
            
            // Click the specified position
            await page.mouse.click(
              captchaBounds.x + (position.x * captchaBounds.width),
              captchaBounds.y + (position.y * captchaBounds.height)
            );
            
            // Wait for captcha to process
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            hCaptchaVisible = false;
          }
        }

        const { id: selectorId, value, type } = mapping;
        const selector = `#${selectorId}`;

        if (selectorId === '') {
          continue;
        }

        if (type === 'text' || type === 'email' || type === 'tel') {
          console.log('typing', value);
          console.log('selector', selector);
          
          // Check for captcha before hovering
          const preCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (preCaptcha) {
            console.log('Captcha detected before hover, canceling action');
            continue;
          }
          
          // Hover over input first
          await page.hover(selector);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
          
          // Check for captcha before clicking
          const postHoverCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (postHoverCaptcha) {
            console.log('Captcha detected after hover, canceling action');
            continue;
          }
          
          // Click the input to focus it
          await page.click(selector);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
          
          // Type each character with a random delay
          const chars = (value || 'no').split('');
          for (const char of chars) {
            // Check for captcha before each keystroke
            const typingCaptcha = await page.$('iframe[title*="hCaptcha"]');
            if (typingCaptcha) {
              console.log('Captcha detected during typing, canceling action');
              continue;
            }
            await page.keyboard.type(char, {delay: Math.random() * 200 + 50});
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
          
          // Check for captcha before tab
          const postTypeCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (!postTypeCaptcha) {
            await page.keyboard.press('Tab');
          }
          
        } else if (type === 'select-one') {
          // Check for captcha before hover
          const preCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (preCaptcha) {
            console.log('Captcha detected before hover, canceling action');
            continue;
          }
          
          await page.hover(selector);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
          
          // Check for captcha before click
          const postHoverCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (postHoverCaptcha) {
            console.log('Captcha detected after hover, canceling action');
            continue;
          }
          
          await page.click(selector);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
          
          // Check for captcha before select
          const preSelectCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (!preSelectCaptcha) {
            await page.select(selector, value);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          }
          
        } else if (type === 'file') {
          const input = await page.$(selector);
          if (input) {
            // Check for captcha before hover
            const preCaptcha = await page.$('iframe[title*="hCaptcha"]');
            if (preCaptcha) {
              console.log('Captcha detected before hover, canceling action');
              continue;
            }
            
            await page.hover(selector);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
            
            // Check for captcha before click
            const postHoverCaptcha = await page.$('iframe[title*="hCaptcha"]');
            if (postHoverCaptcha) {
              console.log('Captcha detected after hover, canceling action');
              continue;
            }
            
            await page.click(selector);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
            
            // Check for captcha before upload
            const preUploadCaptcha = await page.$('iframe[title*="hCaptcha"]');
            if (!preUploadCaptcha) {
              await input.uploadFile(value);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
            }
          }
          
        } else if (type === 'checkbox') {
          // Check for captcha before hover
          const preCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (preCaptcha) {
            console.log('Captcha detected before hover, canceling action');
            continue;
          }
          
          const escapedSelector = selector.replace(/([\[\]])/g, '\\$1');
          await page.hover(escapedSelector);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
          
          // Check for captcha before click
          const postHoverCaptcha = await page.$('iframe[title*="hCaptcha"]');
          if (!postHoverCaptcha) {
            await page.click(escapedSelector);
          }
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