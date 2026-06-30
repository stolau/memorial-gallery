import { useParams } from "react-router-dom";
import { getPerson } from "../api/client";

// getPerson imported to exercise the typed client in the build.
void getPerson;

function PersonPage() {
  const { slug } = useParams();
  return <h1>Person: {slug}</h1>;
}

export default PersonPage;
