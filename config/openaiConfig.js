const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.2
});

const openai = new OpenAIApi(configuration);

module.exports = openai;