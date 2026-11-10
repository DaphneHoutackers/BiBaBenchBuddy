import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Exercise the app's existing declarative routing APIs in both deployment modes.
for (const [name, Router, url] of [
  ['web', BrowserRouter, 'https://example.test/Home'],
  ['desktop', HashRouter, 'file:///app/index.html#/Home'],
]) {
  test(`${name} router renders existing routes and navigation with React 18`, async () => {
    const dom = new JSDOM('<div id="root"></div>', { url });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    function Missing() { return React.createElement('p', null, useLocation().pathname); }
    const root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(Router, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/Home', element: React.createElement('p', null, 'Home') }),
        React.createElement(Route, { path: '*', element: React.createElement(Missing) }),
      ),
    )));
    assert.equal(document.getElementById('root').textContent, 'Home');
    await act(async () => {
      if (name === 'desktop') dom.window.location.hash = '#/missing';
      else dom.window.history.pushState(null, '', '/missing');
      dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(document.getElementById('root').textContent, '/missing');
    await act(async () => root.unmount());
    dom.window.close();
  });
}
