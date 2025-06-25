#!/usr/bin/env node

import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seed() {
  const environment = process.argv[2] || 'development';
  const seedFile = join(__dirname, '..', 'seeds', `${environment}.sql`);
  
  console.log(`🌱 Running seed for environment: ${environment}`);
  
  try {
    // SQLファイルを読み込む
    const sql = readFileSync(seedFile, 'utf-8');
    
    // SQLを個別のステートメントに分割
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // 各ステートメントを実行
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      
      try {
        const { stdout, stderr } = await execAsync(
          `pnpm wrangler d1 execute mentor-diary-db --local --command="${statement.replace(/"/g, '\\"')}"`
        );
        
        if (stderr) {
          console.error(`⚠️  Warning: ${stderr}`);
        }
        
        console.log('✅ Success');
      } catch (error) {
        console.error(`❌ Failed to execute statement: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✨ Seed completed successfully!');
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();