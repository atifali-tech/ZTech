import ParkWorkspaceClient from '../../../../components/ParkWorkspaceClient';

export default async function ParkWorkspacePage({ params }) {
  const { id } = await params;
  return <ParkWorkspaceClient parkId={id} />;
}
