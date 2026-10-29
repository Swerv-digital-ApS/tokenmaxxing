import { useHud } from "../store.ts";
import { DeskFleet, DeskGoods } from "./RoomGoods.tsx";
import { Modal, WalletLine } from "./ui.tsx";

/**
 * My room's desk: choose between the setups I own, and see the tier the company's house desks have. Nothing
 * is sold here; monitors and the house desks are bought at Møbelhuset.
 */
export function DeskPanel() {
  const wallet = useHud((s) => s.wallet);
  return (
    <Modal title="🏠 My room: desk" wide>
      {wallet && <WalletLine balance={wallet.balance} />}
      <DeskGoods buy={false} />
      <DeskFleet buy={false} />
    </Modal>
  );
}
