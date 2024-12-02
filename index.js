const { fillGreenhouseApplication, fillGreenhouseApplicationV2 } = require('./services/puppeteerService');
const formatWithGPT = require('./services/openaiService');
const resumeData = require('./data/resumeData');

// Example usage
fillGreenhouseApplicationV2('https://job-boards.greenhouse.io/tailscale/jobs/4480110005', resumeData);
// fillGreenhouseApplicationV2('https://boards.greenhouse.io/inthepocket/jobs/4902792', resumeData);

// Example usage:
// fillGreenhouseApplication('https://boards.greenhouse.io/inthepocket/jobs/4902792', resumeData);
// fillGreenhouseApplication('https://job-boards.greenhouse.io/tailscale/jobs/4480110005', resumeData);
module.exports = {
  fillGreenhouseApplication,
  formatWithGPT
};
