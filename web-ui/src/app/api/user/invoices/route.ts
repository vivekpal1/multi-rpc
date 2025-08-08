import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Return mock invoices data for development
    const mockInvoices = {
      invoices: [
        {
          id: "inv_1",
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          amount: 29,
          status: "paid",
          downloadUrl: "#",
        },
        {
          id: "inv_2",
          date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          amount: 29,
          status: "paid",
          downloadUrl: "#",
        },
      ],
    };

    return NextResponse.json(mockInvoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}