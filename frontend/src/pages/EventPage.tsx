import { useParams } from "react-router-dom";
import { getEvent } from "../api/client";

// getEvent imported to exercise the typed client in the build.
void getEvent;

function EventPage() {
  const { slug } = useParams();
  return <h1>Event: {slug}</h1>;
}

export default EventPage;
