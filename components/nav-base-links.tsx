import { HomeIcon, MapIcon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";

// Links shown to everyone, signed in or not.
export function BaseLinks() {
  return (
    <>
      <NavLink href="/" icon={<HomeIcon size={18} />}>
        Home
      </NavLink>
      <NavLink href="/map" icon={<MapIcon size={18} />}>
        Map
      </NavLink>
    </>
  );
}
