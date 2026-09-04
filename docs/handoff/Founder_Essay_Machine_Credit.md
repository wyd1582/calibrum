# Two Robots
### Why machines have infinite data and zero credit — and what we're building about it

---

There is a warehouse in Ohio with two identical robots in it.

Same manufacturer. Same model. Same year. Same price.

The first has run 8,000 hours without a single incident. Every maintenance visit completed on schedule. Its motors are healthy, its battery degradation is below fleet average, and its operator has never once had to intervene mid-task.

The second has collided three times, had two joint replacements, and shut down unexpectedly four times in the past month.

Ask a bank to finance these two machines and it will quote roughly the same rate. Ask an insurer to cover them and it will quote roughly the same premium.

This is not because the financial industry doesn't know the risks are different. Everyone knows they're different. It's because there is no credible way to *prove* they're different — no evidence a lender or insurer can independently verify, no history that survives a change of owner, no score that a counterparty on the other side of the world can check in half a second.

For the first time in history, we have a class of assets that generates more data than any asset ever has — and none of it counts as financial evidence.

**Machines have infinite data and zero credit.**

---

## Underwriting Distance

Here is why the data doesn't count.

Trace what happens when a robot has an incident today. The sensor records it. The OEM's cloud ingests it — in the OEM's format, under the OEM's control. The operator files a report — written by the party with the strongest incentive to minimize it. A broker summarizes the report. An insurer evaluates the summary. A reinsurer prices the insurer's evaluation. Somewhere at the end of this chain, a capital decision gets made.

Call the number of trusted intermediaries between a machine event and a capital decision the **Underwriting Distance**. For machines today, it is five or six. Every node in that chain can edit the data, has its own interests, uses its own format, and adds its own delay. None of it can be independently re-verified by the party writing the check.

The consequence is a simple and brutal law of finance: **unverifiable risk is expensive risk.** When an underwriter cannot distinguish the good robot from the bad one, both pay the bad robot's price. The careful operator subsidizes the careless one. The good machine's owner overpays for insurance and under-borrows against a healthy asset. And the robotics industry as a whole grows slower than demand justifies — because when risk can't be priced, robots consume equity instead of attracting debt.

Human finance solved this problem a century ago, for humans. Credit bureaus, FICO, actuarial tables, rating agencies — an entire machinery for converting behavioral history into cost of capital. That machinery is why a stranger can walk into a bank and walk out with a mortgage.

No equivalent machinery exists for machines. We are building it.

---

## Proof of Operation

The primitive underneath everything we do is what we call **Proof of Operation**: a cryptographically signed receipt that a specific machine performed a specific unit of work under specific conditions.

Not a log file in someone's cloud. A receipt — signed by a key bound to the machine's hardware, recording the task, the hours, the environment, the energy drawn, the interventions, the failures. Raw telemetry stays encrypted and off-chain, where trade secrets belong. What goes on a neutral ledger is the machine's identity, the commitments, and the state transitions — the parts that six mutually distrustful parties all need to agree on.

An honest objection arrives immediately, and we'd rather raise it ourselves: *a signature proves the sensor said X, not that X happened.* Signed garbage is still garbage. The first generation of on-chain agent registries learned this the hard way — flooded with shell registrations and sybil reviews within months of launch, because registering an identity is cheap and performing is expensive.

We designed for that adversary from day one, in three layers. **Physics:** energy draw is checked against claimed workload, vibration spectra against claimed task type, individual histories against fleet-level statistical patterns — faking one record is easy, faking a physically consistent multi-year history is expensive. **Economics:** insurance claims and loan defaults are built-in adversarial audits; a machine with an inflated history eventually surfaces as a loss, and both outcome streams feed back into the score. **Stakes:** the parties who attest — OEMs, servicers, independent validators — post collateral, and fraudulent attestation is slashed. Cheap claims must become expensive to fake. That is the only role a token plays in our system, and the only one it needs.

From verified operation, a model — survival analysis, hazard rates, loss severity, residual value, updated with every operating hour — produces one number: the **Machine Risk Score**. The good robot in Ohio scores 782. The bad one scores 431. For the first time, an insurer, a lender, and a used-equipment buyer on three continents can all see the same difference, verify the same evidence, and price accordingly.

Proof of Operation becomes reputation. Reputation becomes credit. Credit becomes capital.

---

## Wallets before credit

The strange thing about this moment is that the rest of the machine financial stack is being built right now — by other people, at their expense — while the credit layer sits empty.

Machine identity shipped: ERC-8004 put agent identity, reputation, and validation registries on Ethereum mainnet this January. Machine payments shipped: Coinbase revived the HTTP 402 status code that sat unused for thirty years, and within eighteen months Visa, Mastercard, and Stripe had all published machine-payment protocols with stablecoin settlement paths built in. The card networks did the math on what happens when the transacting party is a cost-function with no brand loyalty, and decided to become the cheaper rail rather than be optimized away by it.

So the machine economy is getting wallets before it gets credit. Identity lets a machine say who it is. Payments let it move money. Neither tells anyone whether to *trust it with capital* — what it should pay for insurance, what it can borrow against itself, what it will be worth in five years.

Software agents need wallets. Physical agents need balance sheets — because unlike a chatbot, a robot carries asset value and physical liability. It can be collateral. It can cause a loss. That is where insurance, credit, leasing, and eventually securitization live, and it is the layer nobody has built.

We know the demand is real because the incumbents are already hitting the wall. In China — the fastest-moving robot insurance market on earth — the largest carriers began writing embodied-AI policies in late 2025, paid the first humanoid claim in April 2026, and now cover rental fleets by the hundreds of units. Ask them what's stopping them from scaling and they name it publicly: data barriers, and no credible way to assess risk across manufacturers. The product exists. The pricing infrastructure does not. The insurers are not our competitors. They are our first customers.

---

## The whole company in one line

Everything above compresses into a single line of economics:

**Lower verification cost → shorter underwriting distance → lower uncertainty → lower cost of machine capital.**

That last term is the mission. Every basis point shaved off the cost of machine capital means more robots deployed, cheaper goods moved, and a faster arrival of the productive machine economy everyone keeps forecasting. The forecasts assume the financing problem solves itself. It won't. Someone has to build the credit system.

Human finance took a century to turn behavioral history into cost of capital. The machine economy gets to skip most of that century — because unlike people, machines can sign their own history.

The next billion borrowers may not be human.

We are building their credit system.

---
---

# 两台机器人
### 为什么机器拥有无限的数据、却没有信用——以及我们正在为此做什么

---

俄亥俄州的一个仓库里，有两台一模一样的机器人。

同一个厂商，同一个型号，同一年出厂，同一个价格。

第一台运行了 8,000 小时，零事故。每一次保养都按时完成，电机健康，电池衰减低于车队平均水平，操作员从未在任务中途干预过一次。

第二台撞过三次，换过两次关节，过去一个月异常停机四次。

拿这两台机器去银行融资，报价基本一样。去保险公司投保，保费基本一样。

原因不是金融行业不知道风险不同——所有人都知道不同。原因是没有一种可信的方法去**证明**这种不同：没有放贷方和承保方能独立核验的证据，没有一份换了主人还能延续的历史，没有一个地球另一端的交易对手半秒钟就能查到的分数。

历史上第一次，出现了一类比任何资产都更高频产生数据的资产——而这些数据没有一条算得上金融证据。

**机器拥有无限的数据，却没有信用。**

---

## 承保距离（Underwriting Distance）

数据为什么不算数？沿着一次机器人事故今天的旅程走一遍就明白了。

传感器记录下事故。OEM 的云端接收它——用 OEM 的格式，在 OEM 的控制之下。运营方提交一份报告——由最有动机大事化小的一方来写。经纪人摘要这份报告。保险公司评估这份摘要。再保险公司给保险公司的评估定价。在这条链的尽头某处，一个资本决策被做出。

把"一个机器事件与一个资本决策之间必须经过的受信中介数量"定义为**承保距离**。今天机器的承保距离是五到六。链上每一个节点都能修改数据、都有自己的利益、都用自己的格式、都增加自己的延迟——而写支票的那一方，没有任何环节可以独立复验。

后果是金融里一条简单而残酷的定律：**不可验证的风险就是昂贵的风险。**当承保人分不清好机器人和坏机器人时，两台都按坏的定价。审慎的运营方补贴粗放的运营方；好机器的主人为保险多付钱、却贷不出健康资产应有的额度；整个机器人产业的增长慢于需求——因为风险定不了价的时候，机器人只能消耗股权，而不是吸引债权。

人类金融在一百年前为人类解决了这个问题：征信局、FICO、精算表、评级机构——一整套把行为历史转换成资本成本的机器。这套机器，是一个陌生人能走进银行、走出来时带着一笔房贷的原因。

机器世界没有这套机器。我们在建它。

---

## 运行证明（Proof of Operation）

我们所有产品底下的那个原语，叫**运行证明**：一张密码学签名的收据，证明某台特定的机器、在特定条件下、完成了特定的一单位工作。

它不是某家云端里的日志文件，而是一张收据——由绑定在机器硬件上的密钥签名，记录任务、时长、环境、能耗、干预、故障。原始遥测保持加密、留在链下，商业机密该待在那里。上中立账本的只有机器的身份、承诺和状态变更——也就是六个互不信任的参与方都必须达成一致的那部分。

一个诚实的反驳会立刻出现，我们宁可自己先说出来：**签名只能证明传感器说了 X，不能证明 X 真的发生了。**签过名的垃圾仍然是垃圾。链上 agent 注册表的第一代已经用惨痛的方式验证过这一点——上线几个月就被空壳注册和女巫评价淹没，因为注册身份便宜，履约昂贵。

我们从第一天起就为这个对手做了三层设计。**物理层**：能耗对照声称的工作量，振动谱对照声称的任务类型，单机历史对照车队级统计分布——伪造一条记录容易，伪造一段物理上自洽的多年历史很贵。**经济层**：保险理赔和贷款违约是天然的对抗性审计；一台历史被注水的机器最终会在理赔或违约端现形，而这两条结果数据流都在我们的图谱里，直接回灌进分数。**质押层**：提交证明的各方——OEM、维修商、独立验证节点——必须质押，欺诈性证明会被罚没。廉价的声明必须变得昂贵才能伪造——这是 token 在我们系统里唯一的角色，也是它唯一需要的角色。

在经过验证的运行之上，一个模型——生存分析、风险率、损失严重度、残值曲线，随每一个运行小时更新——输出一个数字：**机器风险分（Machine Risk Score）**。俄亥俄那台好机器人得 782 分，坏的那台得 431 分。第一次，三个大洲上的保险公司、银行和二手设备买家，看到的是同一个差异，验证的是同一份证据，据此各自定价。

运行证明变成声誉。声誉变成信用。信用变成资本。

---

## 先有钱包，后有信用

这个时点最奇特的地方在于：机器金融栈的其余部分正在被别人、花别人的钱建起来——唯独信用层空着。

机器身份已经发货：ERC-8004 今年一月把 agent 的身份、声誉、验证注册表放上了以太坊主网。机器支付已经发货：Coinbase 复活了闲置三十年的 HTTP 402 状态码，十八个月内 Visa、万事达、Stripe 全部发布了内置稳定币结算路径的机器支付协议。卡组织算清了一笔账：当交易发起方变成一个没有品牌忠诚度的成本函数时，与其被它优化掉，不如自己变成那条更便宜的管道。

于是机器经济先拿到了钱包，还没拿到信用。身份让机器能说明自己是谁，支付让它能转移资金——但两者都回答不了"凭什么把资本托付给它"：它该付多少保费，能以自身为抵押借多少钱，五年后还值多少。

软件 agent 需要钱包。实体 agent 需要资产负债表——因为和聊天机器人不同，机器人携带资产价值和物理责任：它可以是抵押品，也可以造成损失。保险、信贷、租赁、直至证券化，全部长在这一层，而这一层没有人建。

我们知道需求是真的，因为在位者已经撞上了墙。在中国——全球跑得最快的机器人保险市场——头部财险公司 2025 年下半年开始承保具身智能，2026 年 4 月赔付了全国首例人形机器人理赔，如今按数百台的规模为租赁车队承保。问他们规模化的阻碍是什么，他们公开点名：数据壁垒，以及缺少跨厂商评估风险的可信方法。产品已经存在，定价基础设施不存在。保险公司不是我们的竞争对手，是我们的第一批客户。

---

## 一行经济学写完整家公司

以上一切压缩成一行：

**验证成本降低 → 承保距离缩短 → 不确定性下降 → 机器资本成本下降。**

最后一项就是使命。机器资本成本每降低一个基点，意味着更多机器人被部署、更便宜的商品被运送、所有人都在预测的那个生产性机器经济更早到来。那些预测都默认融资问题会自己解决。它不会。得有人把信用系统建出来。

人类金融花了一百年把行为历史变成资本成本。机器经济可以跳过这一百年的大部分——因为和人不同，机器可以为自己的历史签名。

下一个十亿借款人，可能不是人类。

我们在为它们建信用系统。
