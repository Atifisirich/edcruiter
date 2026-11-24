import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JobEditor from './JobEditor';
import { blankRole, setUsual } from '@/lib/payGuideEdit';

const noop = () => undefined;
const render = (role = blankRole('b1')) =>
  renderToStaticMarkup(
    React.createElement(JobEditor, {
      role, subjects: ['Physics', 'English'], people: [{ id: 'u1', name: 'Asha Rao', role_name: 'Principal' }],
      campusName: 'Manneguda', campusDecider: 'Asha Rao', pot: null, onChange: noop, onDone: noop, onRemove: noop,
    })
  );

describe('the job editor', () => {
  it('draws the three questions for a brand new job without crashing', () => {
    const html = render();
    expect(html).toContain('Which teachers is this job for?');
    expect(html).toContain('What do you pay each month?');
    expect(html).toContain('Anything extra?');
    expect(html).toContain('Choose the grades this job teaches.');
    expect(html).toContain('Fill in the pay for');
  });

  it('says the job is ready, and previews the offer, once grades and pay are in', () => {
    const r = blankRole('b1');
    r.grades = ['6', '7', '8'];
    r.tiers = r.tiers.map((t, i) => setUsual(t, String([22000, 30000, 40000][i])));
    const html = render(r);
    expect(html).toContain('This job is ready.');
    expect(html).toContain('They may be offered');
    expect(html).toContain('Asha Rao takes the final call');
  });
});
