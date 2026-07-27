import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = "https://mbapi.dswip.com";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const path = params.path.join("/");
    const url = `${API_BASE_URL}/${path}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const path = params.path.join("/");
    const url = `${API_BASE_URL}/${path}`;
    const body = await request.json();

    // Check if endpoint requires form-urlencoded (only customer/add)
    const formUrlencodedEndpoints = ['customer/add'];
    const useFormUrlencoded = formUrlencodedEndpoints.some(endpoint => path.includes(endpoint));

    let requestBody: string;
    let contentType: string;

    if (useFormUrlencoded) {
      // Convert JSON to form-urlencoded
      const formData = new URLSearchParams();
      Object.entries(body).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      requestBody = formData.toString();
      contentType = 'application/x-www-form-urlencoded';
    } else {
      requestBody = JSON.stringify(body);
      contentType = 'application/json';
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: requestBody,
    });

    const data = await response.json();
    // Forward the original status code from the API
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to post data" },
      { status: 500 }
    );
  }
}
