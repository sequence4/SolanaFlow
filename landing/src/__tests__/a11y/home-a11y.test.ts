/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

describe('a11y tests', () => {
  it(
    'minimal a11y test with a basic component', 
    async () => {
      const TestComponent = () => React.createElement('div', {
        role: 'main',
        'aria-label': 'Simple test component'
      }, 'Test content');
      
      const { container } = render(React.createElement(TestComponent));
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
    10000
  );
}); 