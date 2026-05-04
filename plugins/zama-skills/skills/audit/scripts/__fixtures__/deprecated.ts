// BUG: deprecated import — should be @zama-fhe/relayer-sdk
import { createInstance } from "fhevmjs";

export async function bad() {
  return createInstance({ chainId: 11155111 });
}
