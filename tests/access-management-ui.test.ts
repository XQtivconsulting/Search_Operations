import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PeopleAndTeams} from '../src/PeopleAndTeams';
import {RolesPanel} from '../src/RolesPanel';
const data={actor:{id:'admin',roles:['admin']},people:[],teams:[{id:'t',name:'Synthetic team'}],staff:[],team_members:[],research:{records:[]}};
const shared={api:async()=>({}),reload:async()=>{},onDirty:()=>{}};
test('combined People and Teams retains directory filters and team management without the account chooser',()=>{
 const html=renderToStaticMarkup(React.createElement(PeopleAndTeams,{...shared,data,onAddTeam:()=>{},roleFilter:'',onRoleFilterChange:()=>{}}));
 assert.match(html,/Find people/);assert.match(html,/All roles/);assert.match(html,/All teams/);assert.match(html,/Invite person/);assert.match(html,/Manage sourcing teams \(1\)/);assert.match(html,/Synthetic team/);
 assert.doesNotMatch(html,/Start with an existing person|Find an existing account|genuinely new person/);
});
test('permissions page removes introductory training guidance',()=>{
 const html=renderToStaticMarkup(React.createElement(RolesPanel,{...shared,onShowPeople:()=>{}}));
 assert.match(html,/Roles &amp; permissions/);assert.doesNotMatch(html,/Choose a template, then adjust|People with multiple roles|Only the owner authorizes/);
});
