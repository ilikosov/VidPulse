import { Image as AntImage } from 'antd';
import { wrap } from '../wrap';

// Explicit annotation: antd's Image type references an internal type that can't be named in the
// emitted .d.ts (TS4023), so we pin the public type to antd's exported one.
export const Image: typeof AntImage = wrap(AntImage, 'Image');
