import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingRange,reportingPeriods} from '../src/reporting-period';
test('shared reporting controls expose exactly the requested periods',()=>{assert.deepEqual(reportingPeriods.map(p=>p[1]),['Today','This week','This month','Last month','This quarter','Last quarter','Custom','This year']);});
test('October uses fiscal Q3 and April fiscal year start',()=>{
 const today='2026-10-05';
 assert.deepEqual(reportingRange('today',today),{from:today,to:today});
 assert.deepEqual(reportingRange('week',today),{from:today,to:today});
 assert.deepEqual(reportingRange('month',today),{from:'2026-10-01',to:today});
 assert.deepEqual(reportingRange('lastMonth',today),{from:'2026-09-01',to:'2026-09-30'});
 assert.deepEqual(reportingRange('quarter',today),{from:'2026-10-01',to:today});
 assert.deepEqual(reportingRange('lastQuarter',today),{from:'2026-07-01',to:'2026-09-30'});
 assert.deepEqual(reportingRange('year',today),{from:'2026-04-01',to:today});
});
test('fiscal year and quarter boundaries handle January, April and leap years',()=>{
 assert.deepEqual(reportingRange('year','2027-03-31'),{from:'2026-04-01',to:'2027-03-31'});
 assert.deepEqual(reportingRange('year','2027-04-01'),{from:'2027-04-01',to:'2027-04-01'});
 assert.deepEqual(reportingRange('quarter','2027-01-02'),{from:'2027-01-01',to:'2027-01-02'});
 assert.deepEqual(reportingRange('lastQuarter','2027-01-02'),{from:'2026-10-01',to:'2026-12-31'});
 assert.deepEqual(reportingRange('lastQuarter','2027-04-01'),{from:'2027-01-01',to:'2027-03-31'});
 assert.deepEqual(reportingRange('lastMonth','2028-03-01'),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(reportingRange('custom','2026-10-05','2026-08-01','2026-12-01'),{from:'2026-08-01',to:'2026-10-05'});
});
