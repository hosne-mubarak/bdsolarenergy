# Shared UI foundation

TASK-009 adds native-button/input/select primitives, a password visibility control and a modal dialog. Components use shared class tokens in `src/styles/index.css`; fields preserve native/ref props for form integration. Labels use explicit IDs, hint/errors are described by the input, invalid controls expose `aria-invalid`, and buttons preserve disabled behavior.

Dialogs use native `showModal` where available, explicit accessible title, initial focus, keyboard boundary handling, Escape/cancel and trigger focus restoration. The non-native test fallback retains the same keyboard semantics. Native controls are preferred over speculative widget dependencies.

Computed contrast ratios for the selected text/background pairs are 4.61:1 (white/solar green), 8.69:1 (navy/yellow), 6.27:1 (muted text/white), and 7.26:1 (error red/white). Body text uses system sans and a 4px spacing scale, minimum control height 44px, visible focus, reserved image dimensions and reduced-motion styling. Later responsive/accessibility auditing verifies full pages, not just these primitives.

Supported production browsers are current evergreen browsers with native `HTMLDialogElement.showModal` support. The attribute-based DOM fallback is for non-browser test environments; it is not a claim of older-browser modal/inert support. Native modality is validated in the later browser accessibility audit.
