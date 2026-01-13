import { describe, it } from 'node:test';
import assert from 'node:assert';
import { tokenize } from '../../src/lexer/tokenizer.mjs';

describe('Lexer Tokenization', () => {
    it('should tokenize hyphenated identifiers as a single token', () => {
        const input = 'has-property';
        const tokens = tokenize(input);

        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'word');
        assert.strictEqual(tokens[0].value, 'has-property');
        assert.strictEqual(tokens[0].lower, 'has-property');
    });

    it('should distinguish hyphenated identifiers from separate words', () => {
        const input = 'has property';
        const tokens = tokenize(input);

        assert.strictEqual(tokens.length, 2);
        assert.strictEqual(tokens[0].value, 'has');
        assert.strictEqual(tokens[1].value, 'property');
    });

    it('should handle multiple hyphenated identifiers', () => {
        const input = 'has-property is-valid';
        const tokens = tokenize(input);

        assert.strictEqual(tokens.length, 2);
        assert.strictEqual(tokens[0].value, 'has-property');
        assert.strictEqual(tokens[1].value, 'is-valid');
    });
    
    it('should handle underscores in identifiers', () => {
        const input = 'my_variable';
        const tokens = tokenize(input);

        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].value, 'my_variable');
    });
    
    it('should handle mixed case with hyphens', () => {
        const input = 'Has-Property';
        const tokens = tokenize(input);
        
        assert.strictEqual(tokens[0].value, 'Has-Property');
        assert.strictEqual(tokens[0].lower, 'has-property');
    });
});