/* Built-in sample document so the platform can be tried without uploading anything. */
(function (root) {
  'use strict';
  const SAMPLE_DOCUMENT = `# The Future of Remote Work

Remote work has moved from a temporary emergency measure to a permanent part of how companies operate. This report summarises what we learned from surveying 2,400 employees and 310 managers across 14 countries.

## Adoption Is Here to Stay

58% of knowledge workers now work remotely at least one day a week. Fully remote roles make up 12% of all new job postings, up from just 3% before 2020. Most companies that tried hybrid work have no plans to return to five days in the office.

## Productivity and Wellbeing

Employees reported saving an average of 72 minutes per day by not commuting. Two thirds of that time was reinvested in work, family, or exercise. Teams with clear written communication norms were 2.3x more likely to rate their productivity as high. However, 41% of remote employees said they struggle to switch off at the end of the day, which raises the risk of burnout.

## What Great Teams Do Differently

- Set core collaboration hours and protect the rest for focused work
- Default to written, asynchronous updates instead of meetings
- Meet in person with purpose, at least once a quarter
- Measure outcomes, not hours online

## The Cost Equation

Companies that downsized office space saved $11,000 per employee per year on average. Those savings were partly offset by investment in home-office stipends and collaboration software, which grew 35% year over year.

## Looking Ahead

The organisations that win will design work around people, not places. Flexibility is no longer a perk; it is the baseline expectation of top talent. Leaders who build trust, invest in tools, and focus on outcomes will unlock the full potential of distributed teams.
`;
  if (typeof module !== 'undefined' && module.exports) module.exports = { SAMPLE_DOCUMENT };
  else root.SAMPLE_DOCUMENT = SAMPLE_DOCUMENT;
})(typeof window !== 'undefined' ? window : globalThis);
