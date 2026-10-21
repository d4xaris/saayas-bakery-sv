import { GROUPS, type GroupId } from "@/editor/lib/birthdays";

export default function NewStoryDialog(props: {
  onPick: (game: GroupId) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={props.onCancel}>
      <div className="w-full max-w-sm space-y-3 rounded-lg bg-[#2b2b2b] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Which game?</h2>
        {(Object.keys(GROUPS) as GroupId[]).map((id) => (
          <button key={id} className="btn flex w-full items-center gap-3" onClick={() => props.onPick(id)}>
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: GROUPS[id].color }} />
            {GROUPS[id].label}
          </button>
        ))}
        <button className="btn w-full" onClick={props.onCancel}>Cancel</button>
      </div>
    </div>
  );
}