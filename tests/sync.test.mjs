import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DDsameSnapshot} from '../public/sync.js';
test('normalizer key order and omitted undefined fields do not manufacture a planner edit',()=>{const server={days:{'2026-10-22':{blocks:[{id:'b',name:'Task',min:30,type:'work'}]}}},browser={days:{'2026-10-22':{blocks:[{type:'work',id:'b',min:30,name:'Task',color:undefined}]}}};assert.equal(DDsameSnapshot(server,browser),true)});
test('real changes, list order and deleted fields still differ',()=>{assert.equal(DDsameSnapshot({a:1},{a:2}),false);assert.equal(DDsameSnapshot({a:1},{}),false);assert.equal(DDsameSnapshot({tasks:['a','b']},{tasks:['b','a']}),false);assert.equal(DDsameSnapshot(null,{}),false)});
