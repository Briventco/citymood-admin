import { SkeletonRows } from "../_components/ui";

// Loading: skeleton rows in --cm-paper while a screen's data arrives.
export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:pt-7" role="status" aria-label="Loading">
      <div aria-hidden="true" className="mb-6 border-b-[6px] border-cm-black pb-3.5">
        <div className="mb-2 h-3 w-48 bg-cm-rule" />
        <div className="h-10 w-56 bg-cm-rule" />
      </div>
      <SkeletonRows rows={8} />
    </div>
  );
}
