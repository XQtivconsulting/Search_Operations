import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {IconAction} from '../src/IconAction';
test('compact actions preserve native disabled state and an accessible action name',()=>{
 const html=renderToStaticMarkup(React.createElement(IconAction,{label:'Save Partner',disabled:true,onClick:()=>{throw new Error('unexpected save');},children:React.createElement('svg')}));
 assert.match(html,/<button[^>]*disabled=""/);assert.match(html,/aria-label="Save Partner"/);assert.ok(!html.includes('>Save Partner</button>'));
});
