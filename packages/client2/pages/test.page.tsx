import { useAccount, useConnect, useNetwork } from "wagmi";

export default function TestPage() {
  const account = useAccount();
  // console.log({
  //   account: {
  //     address: account.address,
  //     isConnecting: account.isConnecting,
  //     isConnected: account.isConnected,
  //     isReconnecting: account.isReconnecting,
  //     isDisconnected: account.isDisconnected,
  //   },
  // });
  const connect = useConnect();
  const network = useNetwork();
  // console.log({ connect });

  return (
    <div>
      <div>Hello {account.address}</div>
      <div>
        Network: {network.chain?.name}{" "}
        {network.chain?.unsupported ? (
          <span className="text-clay-500">(Wrong network)</span>
        ) : null}
      </div>
      <div>
        <div className="font-bold">useAccount</div>
        <div>
          <div>isConnecting: {account.isConnecting.toString()}</div>
          <div>isConnected: {account.isConnected.toString()}</div>
          <div>isDisconnected: {account.isDisconnected.toString()}</div>
          <div>isReconnecting: {account.isReconnecting.toString()}</div>
        </div>
      </div>
      <div>
        <div className="font-bold">useConnect</div>
        <div>
          <div>Error: {connect.error?.message}</div>
          <div>isLoading: {connect.isLoading.toString()}</div>
          <div>pendingConnector: {connect.pendingConnector?.id}</div>
        </div>
      </div>
      <div>
        <div className="font-bold">useNetwork</div>
        <div>
          <pre>{JSON.stringify(network, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
