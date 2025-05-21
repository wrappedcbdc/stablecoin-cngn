const { expect } = require('chai')
const { spawnSync } = require('child_process')
const path = require('path')

describe('CLI argument parser', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/deployGnosisSafe.js')
  const VALID_ADDR1 = '0x0000000000000000000000000000000000000001'
  const VALID_ADDR2 = '0x0000000000000000000000000000000000000002'
  const RPC_ENV = { RPC_URL: 'http://localhost' }

  function runScript(args = [], env = {}) {
    return spawnSync(
      'node',
      [scriptPath, ...args],
      {
        env: Object.assign({}, process.env, RPC_ENV, env),
        encoding: 'utf8'
      }
    )
  }

  it('errors when RPC_URL is not set', () => {
    // remove RPC_URL from env
    const result = spawnSync(
      'node',
      [scriptPath, `--firstOwner=${VALID_ADDR1}`, `--secondOwner=${VALID_ADDR2}`],
      { env: {}, encoding: 'utf8' }
    )
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: RPC_URL environment variable is not set')
  })

  it('errors when missing --firstOwner', () => {
    const result = runScript([`--secondOwner=${VALID_ADDR2}`])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: --firstOwner argument is required')
  })

  it('errors when invalid first owner address', () => {
    const result = runScript([
      `--firstOwner=invalid`,
      `--secondOwner=${VALID_ADDR2}`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Invalid first owner address')
  })

  it('errors when missing --secondOwner', () => {
    const result = runScript([`--firstOwner=${VALID_ADDR1}`])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: --secondOwner argument is required')
  })

  it('errors when invalid second owner address', () => {
    const result = runScript([
      `--firstOwner=${VALID_ADDR1}`,
      `--secondOwner=0x123`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Invalid second owner address')
  })

  it('errors when threshold is not a number', () => {
    const result = runScript([
      `--firstOwner=${VALID_ADDR1}`,
      `--secondOwner=${VALID_ADDR2}`,
      `--threshold=abc`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Threshold must be 1 or 2')
  })

  it('errors when threshold is out of range (>2)', () => {
    const result = runScript([
      `--firstOwner=${VALID_ADDR1}`,
      `--secondOwner=${VALID_ADDR2}`,
      `--threshold=3`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Threshold must be 1 or 2')
  })

  it('errors when threshold is out of range (<1)', () => {
    const result = runScript([
      `--firstOwner=${VALID_ADDR1}`,
      `--secondOwner=${VALID_ADDR2}`,
      `--threshold=0`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Threshold must be 1 or 2')
  })

  it('errors when signerType=cloudhsm without --hsmKeyLabel', () => {
    const result = runScript([
      `--firstOwner=${VALID_ADDR1}`,
      `--secondOwner=${VALID_ADDR2}`,
      `--signerType=cloudhsm`
    ])
    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: --hsmKeyLabel is required when using cloudhsm signer')
  })
})