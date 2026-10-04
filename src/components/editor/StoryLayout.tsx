import { NavLink, Outlet, useParams } from "react-router";

const tabs = ["info", "edit", "preview", "save"];

export default function StoryLayout() {
  const { id } = useParams();
  return (
    <div className="min-h-screen bg-[#383838] text-neutral-200">
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Story editor</h1>
        <nav className="mb-6 flex justify-center gap-6 border-b border-white/15">
          {tabs.map((t) => (
            <NavLink key={t} to={`/story/${id}/${t}`}
              className={({ isActive }) =>
                `border-b-2 px-2 py-2 capitalize ${isActive ? "border-blue-500 text-blue-400" : "border-transparent"}`}>
              {t}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}