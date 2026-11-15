import { FormControl } from '@angular/forms';
import {
  VaultFormValue,
  buildVaultInput,
  endpointLabel,
  hostValidator,
  isValidHost,
  isValidUrl,
  passwordIntent,
  portValidator,
  requiredFieldsFor,
  urlValidator,
} from './vault-form.util';

const base: VaultFormValue = {
  type: 'Server',
  title: '  Prod DB  ',
  email: '',
  host: '10.0.0.5',
  port: '5432',
  username: 'postgres',
  password: '',
  url: '',
  notes: '',
  customerId: null,
  projectId: 7,
};

describe('vault form rules', () => {
  it('accepts IPs and hostnames, rejects junk', () => {
    for (const ok of ['10.0.0.5', 'imap.gmail.com', 'srv-01', 'fe80::1']) expect(isValidHost(ok)).withContext(ok).toBeTrue();
    for (const bad of ['', 'http://x.com', 'a b', '-bad.com', 'a_b.com']) expect(isValidHost(bad)).withContext(bad).toBeFalse();
  });

  it('requires http(s) URLs', () => {
    expect(isValidUrl('https://cpanel.example.com:2083')).toBeTrue();
    expect(isValidUrl('ftp://x.com')).toBeFalse();
    expect(isValidUrl('example.com')).toBeFalse();
  });

  it('validates controls (empty passes; pair with required)', () => {
    expect(hostValidator(new FormControl(''))).toBeNull();
    expect(hostValidator(new FormControl('a b'))).toEqual({ host: true });
    expect(urlValidator(new FormControl('x'))).toEqual({ url: true });
    expect(portValidator(new FormControl(''))).toBeNull();
    expect(portValidator(new FormControl(65535))).toBeNull();
    expect(portValidator(new FormControl(0))).toEqual({ port: true });
    expect(portValidator(new FormControl('70000'))).toEqual({ port: true });
  });

  it('makes email required for Email accounts and host for Server accounts', () => {
    expect(requiredFieldsFor('Email')).toEqual({ email: true, host: false });
    expect(requiredFieldsFor('Server')).toEqual({ email: false, host: true });
  });

  describe('password intent', () => {
    it('create: typed → replace, empty → not sent', () => {
      expect(passwordIntent('create', 'x', false)).toBe('replace');
      expect(passwordIntent('create', '', false)).toBe('keep');
    });

    it('edit: empty keeps, text replaces, explicit remove wins', () => {
      expect(passwordIntent('edit', '', false)).toBe('keep');
      expect(passwordIntent('edit', 'new', false)).toBe('replace');
      expect(passwordIntent('edit', 'new', true)).toBe('remove');
    });
  });

  it('builds the payload: trimmed text, numeric port, password per intent', () => {
    const keep = buildVaultInput(base, 'keep');
    expect(keep).toEqual(jasmine.objectContaining({ type: 'Server', title: 'Prod DB', host: '10.0.0.5', port: 5432, projectId: 7 }));
    expect('password' in keep).toBeFalse();
    expect(keep.email).toBeUndefined();
    expect(keep.customerId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(keep))).not.toEqual(jasmine.objectContaining({ password: jasmine.anything() }));

    expect(buildVaultInput({ ...base, password: ' s3cret ' }, 'replace').password).toBe(' s3cret ');
    expect(buildVaultInput(base, 'remove').password).toBe('');
  });

  it('formats host:port', () => {
    expect(endpointLabel('imap.gmail.com', 993)).toBe('imap.gmail.com:993');
    expect(endpointLabel('fe80::1', 22)).toBe('[fe80::1]:22');
    expect(endpointLabel('srv', null)).toBe('srv');
    expect(endpointLabel(null, 22)).toBeNull();
  });
});
