import { useConnectModal } from "@rainbow-me/rainbowkit";

/**
 * A drop-in connect button that opens RainbowKit's modal.
 * Use this anywhere we used to call `connectWallet("0xd2…")` directly.
 */
export function ConnectWalletButton({ label = "Connect Wallet", style }: { label?: string; style?: React.CSSProperties }) {
  const { openConnectModal } = useConnectModal();
  return (
    <button
      onClick={() => openConnectModal?.()}
      style={style ?? {
        background: "#f472b6",
        color: "#fff",
        border: "none",
        borderRadius: 100,
        padding: "12px 28px",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
