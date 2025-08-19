import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="item-center flex justify-center">
      {" "}
      <SignIn />{" "}
    </div>
  );
}
