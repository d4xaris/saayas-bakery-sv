export default function ConfirmDialog(props: {
  title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={props.onCancel}>
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-[#2b2b2b] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{props.title}</h2>
        <p className="text-sm text-neutral-300">{props.message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={props.onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={props.onConfirm}>{props.confirmLabel ?? "Delete"}</button>
        </div>
      </div>
    </div>
  );
}