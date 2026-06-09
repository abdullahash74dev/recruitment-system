import StorageImage from "@/components/StorageImage";
import { Building2 } from "lucide-react";

export interface ProjectLogoProps {
  path: string | null;
  alt?: string;
  height?: number | null;
  width?: number | null;
  fit?: string | null;          // contain | cover | fill | scale-down | none
  radius?: number | null;
  rotation?: number | null;
  padding?: number | null;
  bgColor?: string | null;
  shadow?: boolean | null;
  border?: boolean | null;
  className?: string;
  fallbackClassName?: string;
}

const ProjectLogo = ({
  path,
  alt = "",
  height = 64,
  width,
  fit = "contain",
  radius = 12,
  rotation = 0,
  padding = 0,
  bgColor,
  shadow = false,
  border = false,
  className = "",
  fallbackClassName = "w-16 h-16",
}: ProjectLogoProps) => {
  const h = height ?? 64;
  const containerStyle: React.CSSProperties = {
    height: `${h}px`,
    width: width ? `${width}px` : "auto",
    minWidth: width ? `${width}px` : `${h}px`,
    borderRadius: `${radius ?? 0}px`,
    padding: `${padding ?? 0}px`,
    backgroundColor: bgColor || "transparent",
    transform: `rotate(${rotation ?? 0}deg)`,
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  };
  const imgClass = `w-full h-full object-${fit || "contain"}`;

  if (!path) {
    return (
      <div
        style={containerStyle}
        className={`${border ? "border border-border" : ""} ${shadow ? "shadow-md" : ""} bg-muted ${fallbackClassName} ${className}`}
      >
        <Building2 className="w-1/2 h-1/2 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      className={`${border ? "border border-border" : ""} ${shadow ? "shadow-md" : ""} ${className}`}
    >
      <StorageImage path={path} alt={alt} className={imgClass} />
    </div>
  );
};

export default ProjectLogo;
