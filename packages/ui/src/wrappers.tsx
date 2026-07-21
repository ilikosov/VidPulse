import { forwardRef, type ComponentProps } from 'react';
import {
  Input as AntInput,
  Modal as AntModal,
  Segmented as AntSegmented,
  Select as AntSelect,
  Space as AntSpace,
  Tag as AntTag,
  Typography as AntTypography,
} from 'antd';

/**
 * Thin wrappers so these components are implemented (and owned) by @vidpulse/ui rather than
 * re-exported straight from antd. Each forwards every prop (and the ref, for form controls) and
 * re-attaches the compound statics the app uses (Input.Search, Modal.confirm, Typography.Text, …).
 *
 * The runtime is a passthrough over Ant Design; each export is cast to `typeof AntX` so its public
 * type — generics (`Select<T>`, `Segmented<T>`), refs and statics — stays identical to antd's, and
 * the app type-checks exactly as before while depending only on @vidpulse/ui.
 */

const InputInner = forwardRef<unknown, ComponentProps<typeof AntInput>>((props, ref) => (
  <AntInput ref={ref as never} {...props} />
));
InputInner.displayName = 'Input';
export const Input = Object.assign(InputInner, {
  TextArea: AntInput.TextArea,
  Search: AntInput.Search,
  Password: AntInput.Password,
  Group: AntInput.Group,
  OTP: AntInput.OTP,
}) as unknown as typeof AntInput;

const SelectInner = forwardRef<unknown, ComponentProps<typeof AntSelect>>((props, ref) => (
  <AntSelect ref={ref as never} {...props} />
));
SelectInner.displayName = 'Select';
export const Select = Object.assign(SelectInner, {
  Option: AntSelect.Option,
  OptGroup: AntSelect.OptGroup,
}) as unknown as typeof AntSelect;

const TagInner = forwardRef<unknown, ComponentProps<typeof AntTag>>((props, ref) => (
  <AntTag ref={ref as never} {...props} />
));
TagInner.displayName = 'Tag';
export const Tag = Object.assign(TagInner, {
  CheckableTag: AntTag.CheckableTag,
}) as unknown as typeof AntTag;

const ModalInner = (props: ComponentProps<typeof AntModal>) => <AntModal {...props} />;
ModalInner.displayName = 'Modal';
export const Modal = Object.assign(ModalInner, {
  confirm: AntModal.confirm,
  info: AntModal.info,
  success: AntModal.success,
  error: AntModal.error,
  warning: AntModal.warning,
  useModal: AntModal.useModal,
  destroyAll: AntModal.destroyAll,
  config: AntModal.config,
}) as unknown as typeof AntModal;

const SpaceInner = (props: ComponentProps<typeof AntSpace>) => <AntSpace {...props} />;
SpaceInner.displayName = 'Space';
export const Space = Object.assign(SpaceInner, {
  Compact: AntSpace.Compact,
}) as unknown as typeof AntSpace;

const TypographyInner = (props: ComponentProps<typeof AntTypography>) => (
  <AntTypography {...props} />
);
TypographyInner.displayName = 'Typography';
export const Typography = Object.assign(TypographyInner, {
  Text: AntTypography.Text,
  Title: AntTypography.Title,
  Paragraph: AntTypography.Paragraph,
  Link: AntTypography.Link,
}) as unknown as typeof AntTypography;

const SegmentedInner = (props: ComponentProps<typeof AntSegmented>) => <AntSegmented {...props} />;
SegmentedInner.displayName = 'Segmented';
export const Segmented = SegmentedInner as unknown as typeof AntSegmented;

// message is antd's imperative API object (message.success/error/…). Wrapping it would break method
// binding and its internal types can't be named in a .d.ts, so the kit owns the export by re-exporting.
export { message } from 'antd';
