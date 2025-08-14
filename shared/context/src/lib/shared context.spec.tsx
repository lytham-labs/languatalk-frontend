import { render } from '@testing-library/react';

import SharedContext from './shared context';

describe('SharedContext', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SharedContext />);
    expect(baseElement).toBeTruthy();
  });
});
