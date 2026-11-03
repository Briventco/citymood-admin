"use client";

// A filter <select> that submits its GET form on change. Without JS, the form's
// Enter key or its submit button still work.
export function AutoSubmitSelect(props: React.ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
