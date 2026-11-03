"use client";

// ADMIN_SPEC §4: role="switch" with aria-checked, 52×30. On: lime track. Off:
// white track. Both have a black border and a black knob. Label it with
// aria-labelledby pointing at the visible label.

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  /** Inside a black band (mobile breaking switch): lime border instead of black. */
  onDark?: boolean;
};

export function Switch({ checked, onChange, labelledBy, describedBy, disabled, onDark = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // The visible track is 52×30; the padding keeps the tap target at 44px.
      className="-my-[7px] flex shrink-0 items-center py-[7px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`flex h-[30px] w-[52px] items-center border-2 p-[3px] ${checked ? "justify-end bg-cm-lime" : "justify-start bg-cm-white"} ${
          onDark ? (checked ? "border-cm-lime" : "border-cm-white") : "border-cm-black"
        }`}
      >
        <span className="block size-5 bg-cm-black" />
      </span>
    </button>
  );
}
