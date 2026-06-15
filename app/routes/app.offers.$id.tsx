import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  DataTable,
  Button,
  Box,
  Banner,
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getOffer, updateOfferStatus } from "../models/offer.server";

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:     { tone: undefined,  label: "Draft" },
  reserved:  { tone: "info",     label: "Reserved" },
  partial:   { tone: "warning",  label: "Partial" },
  completed: { tone: "success",  label: "Completed" },
  cancelled: { tone: "critical", label: "Cancelled" },
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  draft:     [{ label: "Mark as Reserved", next: "reserved" }, { label: "Cancel", next: "cancelled" }],
  reserved:  [{ label: "Mark as Partial",  next: "partial" },  { label: "Mark as Completed", next: "completed" }, { label: "Cancel", next: "cancelled" }],
  partial:   [{ label: "Mark as Completed", next: "completed" }],
  completed: [],
  cancelled: [],
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offer = await getOffer(session.shop, params.id!);
  if (!offer) throw new Response("Not Found", { status: 404 });
  return json({ offer });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "updateStatus") {
    const status = formData.get("status") as string;
    await updateOfferStatus(session.shop, params.id!, status);
  }

  return json({ ok: true });
};

export default function OfferDetail() {
  const { offer } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const badge = STATUS_BADGE[offer.status] ?? { tone: undefined, label: offer.status };
  const transitions = STATUS_TRANSITIONS[offer.status] ?? [];
  const shortId = `OFF-${offer.id.slice(-6).toUpperCase()}`;

  function changeStatus(next: string) {
    const fd = new FormData();
    fd.append("intent", "updateStatus");
    fd.append("status", next);
    submit(fd, { method: "post" });
  }

  const lineRows = offer.items.map((item) => [
    item.description ?? "—",
    item.supplierSku ?? "—",
    String(item.qtyReserved),
    `$${item.unitCost.toFixed(2)}`,
    `$${(item.qtyReserved * item.unitCost).toFixed(2)}`,
  ]);

  return (
    <Page>
      <TitleBar title={shortId}>
        <button onClick={() => navigate("/app/offers")}>Back</button>
      </TitleBar>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h1" variant="headingLg">{shortId}</Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Created {new Date(offer.createdAt).toLocaleDateString()}
                      </Text>
                    </BlockStack>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </InlineStack>
                  <Divider />
                  <InlineGrid columns={3} gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Supplier</Text>
                      <Text as="p" variant="bodyMd">{offer.supplier.name}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">ETA</Text>
                      <Text as="p" variant="bodyMd">
                        {offer.eta ? new Date(offer.eta).toLocaleDateString() : "—"}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">End Date</Text>
                      <Text as="p" variant="bodyMd">
                        {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : "—"}
                      </Text>
                    </BlockStack>
                  </InlineGrid>
                  {offer.notes && (
                    <>
                      <Divider />
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">Notes</Text>
                        <Text as="p" variant="bodyMd">{offer.notes}</Text>
                      </BlockStack>
                    </>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Reserved Items</Text>
                  <Divider />
                  {offer.items.length === 0 ? (
                    <Text as="p" variant="bodyMd" tone="subdued">No items.</Text>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric", "numeric"]}
                      headings={["Description", "Supplier SKU", "Qty Reserved", "Unit Cost", "Est. Total"]}
                      rows={lineRows}
                    />
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Summary</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Items</Text>
                    <Text as="span" variant="bodyMd">{offer.items.length}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Total Qty</Text>
                    <Text as="span" variant="bodyMd">
                      {offer.items.reduce((s, i) => s + i.qtyReserved, 0)}
                    </Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Est. Total</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">
                      ${offer.totalEstimatedCost.toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {transitions.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Actions</Text>
                    <Divider />
                    <BlockStack gap="200">
                      {transitions.map((t) => (
                        <Button
                          key={t.next}
                          variant={t.next === "cancelled" ? undefined : "primary"}
                          tone={t.next === "cancelled" ? "critical" : undefined}
                          fullWidth
                          onClick={() => changeStatus(t.next)}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}

              {offer.status === "completed" && (
                <Banner tone="success">
                  <Text as="p" variant="bodyMd">This offer has been completed.</Text>
                </Banner>
              )}
              {offer.status === "cancelled" && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">This offer has been cancelled.</Text>
                </Banner>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
