async function autoScrollAndGatherFields(page) {
    const allFields = new Set();
    
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
  
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Capture the entire HTML of the form
    const formHTML = await page.evaluate(() => {
      const form = document.querySelector('.main');
      return form ? form.outerHTML : null;
    });
  
    // Gather fields after scrolling is complete
    const fields = await page.evaluate(() => {
      const fields = [];
      document.querySelectorAll('input, select, textarea').forEach(element => {
        // Get the fieldset legend text if element is inside a fieldset
        let label = null;
        const fieldset = element.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) {
            label = legend.textContent.trim();
          }
        }

        const field = {
          type: element.type || element.tagName.toLowerCase(),
          id: element.id,
          name: element.name,
          placeholder: element.placeholder,
          required: element.required,
          value: element.value,
          label: label, // Add the fieldset legend as label
          description: element.getAttribute('description'), // Get description attribute
          options: element.tagName === 'SELECT' ? 
            Array.from(element.options).map(opt => ({
              value: opt.value,
              text: opt.text
            })) : null
        };

        // For checkbox groups, get associated label text
        if (element.type === 'checkbox') {
          const labelElement = document.querySelector(`label[for="${element.id}"]`);
          if (labelElement) {
            field.optionLabel = labelElement.textContent.trim();
          }
        }

        fields.push(field);
      });
      return fields;
    });
  
    return { fields_to_map: fields, html_for_form_for_custom_fields: formHTML };
  }

  module.exports = {
    autoScrollAndGatherFields
  };