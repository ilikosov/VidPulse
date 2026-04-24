/**
 * Test script for the K-pop video title parser
 * 
 * Run with: npx ts-node src/test-parser.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { parseTitle } from './services/parser/parser.service';

// Sample K-pop video titles for testing
const testTitles = [
  // ITZY fancam examples
  '[240315] ITZY "WANNABE" @MCOUNTDOWN - YEJI Vertical Fancam',
  'ITZY(잇지) \"LOCO\" Music Core 211002 LIA FANCAM',
  '[4K] ITZY 이치 - CHESHIRE @인기가요 inkigayo 221204',
  
  // BTS examples
  'BTS (방탄소년단) \"Dynamite\" @INKIGAYO 200830',
  '[FOCUS] JIMIN of BTS \"Filter\" Performance @MBC 200306',
  
  // BLACKPINK examples
  'BLACKPINK - \"DDU-DU DDU-DU\" @MAMA 181214',
  'ROSÉ - \"On The Ground\" @INKIGAYO 210321 Solo Stage',
  
  // NewJeans examples
  'NewJeans (뉴진스) \"Hype Boy\" @MCOUNTDOWN 220804',
  '[입덕직캠] 뉴진스 MINJI \"Cookie\" M COUNTDOWN 220901',
  
  // Generic/needs review examples
  'K-pop Dance Practice Video 2024',
  'Amazing Performance by Girl Group',
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('K-pop Video Title Parser Test');
  console.log('='.repeat(70));
  console.log();

  for (const title of testTitles) {
    console.log('-'.repeat(70));
    console.log(`TITLE: ${title}`);
    console.log('-'.repeat(70));

    try {
      const result = await parseTitle(title);
      
      console.log('EXTRACTED METADATA:');
      console.log(`  perf_date:    ${result.metadata.perf_date || '(not found)'}`);
      console.log(`  group_name:   ${result.metadata.group_name || '(not found)'}`);
      console.log(`  artist_name:  ${result.metadata.artist_name || '(not found)'}`);
      console.log(`  song_title:   ${result.metadata.song_title || '(not found)'}`);
      console.log(`  event:        ${result.metadata.event || '(not found)'}`);
      console.log(`  camera_type:  ${result.metadata.camera_type || '(not found)'}`);
      console.log(`  confidence:   ${(result.metadata.confidence ?? 0).toFixed(2)}`);
      console.log();
      console.log(`NEEDS REVIEW: ${result.needsReview ? 'YES ⚠️' : 'NO ✓'}`);
    } catch (error) {
      console.error('ERROR:', error);
    }
    
    console.log();
  }

  console.log('='.repeat(70));
  console.log('Test completed!');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
