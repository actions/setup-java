import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as fs from 'fs';
import os from 'os';
import path from 'path';

const mockWarning = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: mockWarning
}));

const {blockCompromisedCertificates, COMPROMISED_CERT_FINGERPRINTS} =
  await import('../src/blocked-certs.js');

describe('blockCompromisedCertificates', () => {
  let javaHome: string;

  const writeList = (relative: string, content: string): string => {
    const file = path.join(javaHome, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, content);
    return file;
  };

  const fingerprintsIn = (file: string): string[] =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(line => /^[0-9A-F]{64}$/.test(line));

  beforeEach(() => {
    javaHome = fs.mkdtempSync(path.join(os.tmpdir(), 'blocked-certs-'));
  });

  afterEach(() => {
    fs.rmSync(javaHome, {recursive: true, force: true});
    jest.resetAllMocks();
  });

  it('appends the fingerprints to lib/security/blocked.certs', () => {
    const file = writeList(
      'lib/security/blocked.certs',
      'Algorithm=SHA-256\nAAAA'
    );

    blockCompromisedCertificates(javaHome);

    const content = fs.readFileSync(file, 'utf8');
    expect(content.startsWith('Algorithm=SHA-256\nAAAA\n')).toBe(true);
    expect(fingerprintsIn(file)).toEqual([...COMPROMISED_CERT_FINGERPRINTS]);
    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('is idempotent', () => {
    const file = writeList('lib/security/blocked.certs', 'Algorithm=SHA-256\n');

    blockCompromisedCertificates(javaHome);
    blockCompromisedCertificates(javaHome);

    expect(fingerprintsIn(file)).toHaveLength(
      COMPROMISED_CERT_FINGERPRINTS.length
    );
  });

  it('only adds fingerprints that are missing', () => {
    const file = writeList(
      'lib/security/blocked.certs',
      `Algorithm=SHA-256\n${COMPROMISED_CERT_FINGERPRINTS[0].toLowerCase()}\n`
    );

    blockCompromisedCertificates(javaHome);

    expect(fingerprintsIn(file)).toEqual(
      COMPROMISED_CERT_FINGERPRINTS.slice(1)
    );
  });

  it('updates blacklisted.certs in both the JDK and bundled JRE of older JDKs', () => {
    const jdk = writeList(
      'lib/security/blacklisted.certs',
      'Algorithm=SHA-256\n'
    );
    const jre = writeList(
      'jre/lib/security/blacklisted.certs',
      'Algorithm=SHA-256\n'
    );

    blockCompromisedCertificates(javaHome);

    expect(fingerprintsIn(jdk)).toHaveLength(
      COMPROMISED_CERT_FINGERPRINTS.length
    );
    expect(fingerprintsIn(jre)).toHaveLength(
      COMPROMISED_CERT_FINGERPRINTS.length
    );
  });

  it('warns and leaves the file alone when it does not use SHA-256', () => {
    const file = writeList('lib/security/blocked.certs', 'Algorithm=SHA-1\n');

    blockCompromisedCertificates(javaHome);

    expect(fs.readFileSync(file, 'utf8')).toBe('Algorithm=SHA-1\n');
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('does not use SHA-256')
    );
  });

  it('warns when no blocked certificates list exists', () => {
    blockCompromisedCertificates(javaHome);

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Could not find a blocked certificates list')
    );
  });
});
