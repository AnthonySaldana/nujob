const puppeteer = require('puppeteer');
const { autoScrollAndGatherFields } = require('../utils/formUtils');
const formatWithGPT = require('./openaiService');

// async function fillGreenhouseApplicationV2(jobUrl, resumeData) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
  
//   try {
//     // Navigate to the job application page
//     await page.goto(jobUrl);

//     // Wait for the form to load
//     await page.waitForSelector('#application-form');

//     const formFields = await autoScrollAndGatherFields(page);

//     // Use GPT to map resume data to form fields
//     const mappingPrompt = {
//       formFields,
//       resumeData
//     };
    
//     console.log(mappingPrompt, 'mappingPrompt');
    
//     const fieldMappings = await formatWithGPT(mappingPrompt);

//     console.log(fieldMappings, 'fieldMappings');

//     // Get all labels and their associated input/select elements
//     const fields = await page.evaluate(() => {
//       const labels = Array.from(document.querySelectorAll('label'));
//       return labels.map(label => {
//         const forAttr = label.getAttribute('for');
//         const inputElement = forAttr ? document.getElementById(forAttr) : null;

//         return {
//           label: label.textContent.trim().toLowerCase(),
//           for: forAttr,
//           tagName: inputElement ? inputElement.tagName.toLowerCase() : null,
//           id: forAttr,
//           type: inputElement ? inputElement.type : null
//         };
//       });
//     });

//     // Helper function to find the best match from resumeData
//     const findBestMatch = (label, resumeData) => {
//       if (label.toLowerCase().includes('first name')) return resumeData.personalInfo.firstName;
//       if (label.toLowerCase().includes('last name')) return resumeData.personalInfo.lastName;
//       if (label.toLowerCase().includes('email')) return resumeData.personalInfo.email;
//       if (label.toLowerCase().includes('phone')) return resumeData.personalInfo.phone;
//       if (label.toLowerCase().includes('linkedin')) return resumeData.linkedIn;
//       if (label.toLowerCase().includes('website')) return resumeData.website;
//       if (label.toLowerCase().includes('why are you interested')) return resumeData.summary;
//       if (label.toLowerCase().includes('relocate')) return 'Yes'; // Example for dropdown
//       if (label.toLowerCase().includes('visa sponsorship')) return 'No'; // Example for dropdown
//       if (label.toLowerCase().includes('tailscale before')) return 'No'; // Example for dropdown
//       if (label.toLowerCase().includes('resume')) return { type: 'file', file: resumeData.resumeFile };
//       if (label.toLowerCase().includes('cover letter')) return { type: 'file', file: resumeData.coverLetterFile };
//       return null;
//     };

//     // Iterate over fields and fill dynamically
//     for (const field of fields) {
//       try {
//         const value = findBestMatch(field.label, resumeData);

//         if (!value) continue;

//         if (field.tagName === 'input' && field.type !== 'file') {
//           await page.type(`#${field.id}`, value);
//         } else if (field.tagName === 'textarea') {
//           await page.type(`#${field.id}`, value);
//         } else if (field.tagName === 'select') {
//           await page.select(`#${field.id}`, value); // Assuming dropdown values match
//         } else if (field.tagName === 'input' && field.type === 'file') {
//           const fileInput = await page.$(`#${field.id}`);
//           if (value.type === 'file') {
//             await fileInput.uploadFile(value.file);
//           }
//         }
//       } catch (fieldError) {
//         console.warn(`Error filling field ${field.label}:`, fieldError);
//       }
//     }

//     // Take a screenshot for verification
//     await page.screenshot({ path: 'application-filled.png', fullPage: true });

//     // Submit the form
//     await page.click('button[type="submit"]');

//   } catch (error) {
//     console.error('Error filling application:', error);
//   } finally {
//     await browser.close();
//   }
// }

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

module.exports = {
  fillGreenhouseApplication,
  fillGreenhouseApplicationV2
};