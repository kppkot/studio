// This file is for the new, correct utility functions.
import type { Block } from './types';

/**
 * Generates a unique ID for a block, prefixed with 'newlab-' for easy identification during development.
 */
export const generateId = (): string => `newlab-${Math.random().toString(36).substring(2, 11)}`;
