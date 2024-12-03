const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: "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",//process.env.OPENAI_API_KEY,
  temperature: 0.2
});

const openai = new OpenAIApi(configuration);

module.exports = openai;