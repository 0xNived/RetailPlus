import { useMemo, useState } from "react";
import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists-neutral.json";

const style = new Style(notionists);

export default function CustomerAvatar({
  name,
  seed,
  large = false,
}: {
  name: string;
  seed: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = useMemo(
    () =>
      new Avatar(style, {
        seed,
        size: 128,
        backgroundColor: [
          "#e9eef5",
          "#e9f0ed",
          "#f3ece7",
          "#eeebf5",
          "#f4f0e4",
        ],
      }).toDataUri(),
    [seed],
  );
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={`rp-avatar rp-illustrated-avatar ${large ? "rp-avatar-large" : ""}`}
      title="Generated profile placeholder"
    >
      {failed ? (
        initials
      ) : (
        <img
          src={image}
          alt=""
          width={large ? 64 : 40}
          height={large ? 64 : 40}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
