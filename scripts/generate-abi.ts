#!/usr/bin/env node
/**
 * Generate ABI files for frontend integration
 * Run: npx tsx scripts/generate-abi.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CONTRACTS_DIR = path.resolve(process.cwd(), 'contracts');
const ABI_DIR = path.resolve(process.cwd(), 'abis');

const contracts = [
  { name: 'core', file: 'core.clar' },
  { name: 'token', file: 'token.clar' },
  { name: 'escrow', file: 'escrow.clar' },
];

function extractFunctions(clarityCode: string): any[] {
  const functions: any[] = [];
  
  const publicMatches = clarityCode.matchAll(/\(define-public\s+\((\w+)\s+([^)]+)\)/g);
  for (const match of publicMatches) {
    functions.push({
      name: match[1],
      access: 'public',
      args: parseArgs(match[2]),
    });
  }
  
  const readonlyMatches = clarityCode.matchAll(/\(define-read-only\s+\((\w+)\s+([^)]+)\)/g);
  for (const match of readonlyMatches) {
    functions.push({
      name: match[1],
      access: 'readonly',
      args: parseArgs(match[2]),
    });
  }
  
  return functions;
}

function parseArgs(argsStr: string): any[] {
  const args: any[] = [];
  const regex = /\((\w+)\s+(string-utf8|uint|int|buff|bool|principal|optional|list|response|tuple)\s*(\d+)?\)/g;
  let match;
  
  while ((match = regex.exec(argsStr)) !== null) {
    const [, name, type, length] = match;
    args.push({
      name,
      type: length ? `${type}${length}` : type,
    });
  }
  
  return args;
}

function generateABI(contractName: string, clarityCode: string) {
  const functions = extractFunctions(clarityCode);
  
  return {
    name: `devfunding-${contractName}`,
    description: `DevFunding ${contractName} contract ABI`,
    functions,
  };
}

async function generateAll() {
  console.log('Generating ABI files...\n');
  
  if (!fs.existsSync(ABI_DIR)) {
    fs.mkdirSync(ABI_DIR, { recursive: true });
  }
  
  for (const contract of contracts) {
    const contractPath = path.join(CONTRACTS_DIR, contract.file);
    
    if (!fs.existsSync(contractPath)) {
      console.log(`⚠️  Contract not found: ${contract.file}`);
      continue;
    }
    
    const code = fs.readFileSync(contractPath, 'utf8');
    const abi = generateABI(contract.name, code);
    
    const abiPath = path.join(ABI_DIR, `${contract.name}.json`);
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    
    console.log(`✅ Generated: ${abiPath} (${abi.functions.length} functions)`);
  }
  
  console.log('\n📦 ABI files generated successfully!');
  console.log(`📁 Location: ${ABI_DIR}\n`);
  
  console.log('Alternative: Use Clarinet to generate ABIs:');
  console.log('  npx clarinet contracts generate-abi');
}

generateAll().catch(console.error);

export { generateABI, generateAll };
