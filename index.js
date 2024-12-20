require('dotenv').config();
const { fillGreenhouseApplication, fillGreenhouseApplicationV2, fillLeverApplication, fillWorkableApplication } = require('./services/puppeteerService');
const formatWithGPT = require('./services/openaiService');
const resumeData = require('./data/resumeData');

// Example usage
// fillGreenhouseApplicationV2('https://job-boards.greenhouse.io/tailscale/jobs/4480110005', resumeData);
fillLeverApplication('https://jobs.lever.co/metabase/85f454d8-e795-4978-8a2b-4b8bfa7d7c37/apply', resumeData);
// fillWorkableApplication('https://jobs.workable.com/en/view/f7paADqVn8vmbouQajKWLN/remote-software-engineer-in-calgary-at-amplifier-health?utm_medium=social_share&utm_source=copy_link', resumeData);
// fillGreenhouseApplicationV2('https://boards.greenhouse.io/inthepocket/jobs/4902792', resumeData);

// Example usage:
// fillGreenhouseApplication('https://boards.greenhouse.io/inthepocket/jobs/4902792', resumeData);
// fillGreenhouseApplication('https://job-boards.greenhouse.io/tailscale/jobs/4480110005', resumeData);
module.exports = {
  fillGreenhouseApplication,
  formatWithGPT
};
