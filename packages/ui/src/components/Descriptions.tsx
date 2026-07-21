import { Descriptions as AntDescriptions } from 'antd';
import { wrap } from '../wrap';

// Explicit annotation: antd's Descriptions type references an internal type that can't be named in
// the emitted .d.ts (TS4023), so we pin the public type to antd's exported one.
export const Descriptions: typeof AntDescriptions = wrap(AntDescriptions, 'Descriptions');
