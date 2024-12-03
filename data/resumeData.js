const resumeData = {
    personalInfo: {
      firstName: 'John',
      lastName: 'Smith',
      email: 'anthonywebsol+test@gmail.com',
      phone: '555-123-4567',
      location: 'San Francisco, CA',
      gender: 'Male',
      veteranStatus: 'No',
      disabilityStatus: 'No',
      hispanic: 'Yes',
      visaSponsorshipRequired: 'No',
    },
    workExperience: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech Corp', 
        startDate: 'January 2020',
        endDate: 'Present',
        description: 'Led development of cloud-based applications using Node.js and React. Improved system performance by 40% through optimization initiatives.'
      },
      {
        title: 'Software Engineer',
        company: 'StartupCo',
        startDate: 'June 2017', 
        endDate: 'December 2019',
        description: 'Developed full-stack web applications using modern JavaScript frameworks. Collaborated with cross-functional teams to deliver features on schedule.'
      }
    ],
    education: [
      {
        school: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        graduationDate: 'May 2017'
      }
    ],
    linkedIn: 'https://www.linkedin.com/in/johnsmith',
    website: 'https://johnsmith.com',
    referral: 'Jane Doe',
    skills: ['JavaScript', 'Node.js', 'React', 'Python', 'SQL', 'AWS', 'Git'],
    summary: 'Experienced software engineer with 6+ years of full-stack development experience, specializing in JavaScript and cloud technologies. Strong track record of delivering high-quality code and mentoring junior developers.'
  };

  module.exports = resumeData;