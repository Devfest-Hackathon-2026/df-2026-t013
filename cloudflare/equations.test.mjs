import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equation,analyze} from './equations.js';
test('compares equations with exact fractions and parentheses',()=>{assert.equal(equation('2x+3=7'),equation('2x=4'));assert.equal(equation('2(x+1)=6'),equation('x=2'));assert.equal(equation('3x=11'),equation('x=\\frac{11}{3}'));assert.notEqual(equation('x=x'),equation('x=x+1'));});
test('finds the first error and refuses unsupported expressions',()=>{assert.equal(analyze(['3x+4=7','3x=11','x=11/3']).index,1);assert.equal(analyze(['x*x=4','x=2']).status,'review');assert.equal(analyze(['x=1']).status,'review');assert.equal(analyze(['x/0=1','x=2']).status,'review');});
