const openai = require('../config/openaiConfig');

async function formatWithGPT(data) {
    try {
        const completion = await openai.createChatCompletion({
          model: "gpt-4o",
          messages: [
            {
              role: "system", 
              content: `Format the user input data for a job application. Use the provided fields array and HTML to map the data.
              Match fields intelligently, even if names differ slightly (e.g., "LinkedIn" vs. "LinkedIn URL"). Calculate years of experience if not given.
              Choose options based on labels or context. For checkboxes, set values to true. If no resume data is available, infer or create values.
              Maintain the original data structure with id, type, and value. Return data in JSON format, focusing only on required fields.
              Fill required fields with placeholders if necessary. For fields with shared ids, return the most relevant one based on labels.
              
              Return only the JSON data. Do not include any other text. Return in the format:
              
              {
                formFields: [
                  {
                    id: '',
                    type: '',
                    value: ''
                  }
                ]
              }`,
            }, 
            {
              role: "user",
              content: JSON.stringify(data)
            }
          ]
        });
    
        return completion.data.choices[0].message.content;
      } catch (error) {
        console.error('Error formatting with GPT:', error);
        return data; // Return original data if GPT formatting fails
    }
}

async function formatWithGPTForCaptcha(imageData) {
  try {
      console.log('formatWithGPTForCaptcha called');
      const completion = await openai.createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a computer vision assistant that helps solve image puzzles. 
            Analyze the provided image and identify the coordinates where the user needs to click to solve the puzzle.
            Return the coordinates as an array of {x, y} objects representing click positions.
            
            The coordinates should be precise pixel positions relative to the image dimensions.
            Return only the JSON data in the format:
            
            {
              "clickPositions": [
                {
                  "x": number,
                  "y": number
                }
              ]
            }
              
            Return the JSON data only. Do not include any other text.`
          },
          {
            role: "user",
            content: [
              {
                "type": "image_url", 
                "image_url": 
                {
                  "url": imageData
                }
              }
            ]
          }
        ]
      });
      console.log('completion attempted');

      console.log('completion.data.choices[0].message.content', completion.data.choices[0].message.content);

      return completion.data.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing captcha with GPT:', error);
      // throw error; // Throw error since we can't proceed without solving captcha
  }
}

module.exports = {
  formatWithGPT,
  formatWithGPTForCaptcha
};